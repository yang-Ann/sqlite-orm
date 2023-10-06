import type { DatabaseParams, SQLiteDatabase, ResultSet, Transaction, SQLError } from "react-native-sqlite-storage";
import { TableFieldsOption, MyObject, WhereType, BuildUpdateByWhenOption } from "./types";
import SqliteOrm from "./SqliteOrm";
/** 开启SQLinte 官方debug */
type P<T = ResultSet> = Promise<T>;
export type TableInfoType = {
    /** 表名 */
    name: string;
    rootpage: number;
    /** 创建时的sql */
    sql: string;
    /** 表名 */
    tbl_name: string;
    /** 类型 */
    type: string;
    /** 版本信息 */
    version?: number;
    /** 从 sql 中解析出来的字段 */
    sqlFieldList: TableFieldsOption[];
};
/** sqlite 自定义查询参数类型, 对应 getByCustom() 的参数类型 */
export type SqliteCustomQueryParamsType<T = any> = [
    query: Partial<T>,
    where?: WhereType,
    queryFields?: string,
    group?: string
];
/**
 * sqlite 操作类
 * 需要注意的是在 Androd 11下需要注释掉 react-native.config.js 里面 dependencies["react-native-sqlite-storage"] 的配置, 不然就会无法执行 sql 语句
 */
declare class SqliteHelper {
    /** react-native-sqlite-storage 的配置 */
    databaseParams: DatabaseParams;
    /** 表格字段配置, 特意写成数组(写成对象顺序, for...in 无法保证顺序) */
    fieldsOption: TableFieldsOption[];
    /** 数据库版本 */
    databaseVersion: number;
    /** 默认查询的字段 */
    queryFields: string;
    /** sql连接对象, 通过 SqliteHelper.getDBConnect() 获取 */
    db: SQLiteDatabase | null;
    sqliteOrm: SqliteOrm;
    constructor(
    /** react-native-sqlite-storage 的配置 */
    databaseParams: DatabaseParams, 
    /** 表格字段配置, 特意写成数组(写成对象顺序, for...in 无法保证顺序) */
    fieldsOption: TableFieldsOption[], 
    /** 数据库版本 */
    databaseVersion?: number, 
    /** 默认查询的字段 */
    queryFields?: string);
    /**
     * 初始化
     */
    init(): Promise<SqliteHelper | Error>;
    /** 保存本地数据库版本信息 */
    saveDBVersionInfo(): void;
    /**
     * 如果本地存在表数据, 该方法可以比较本地数据和 thsi.fieldsOption 里面的字段,
     * 如果新增了则会自动添加(减少了不管), 补充本地字段信息
     * 注意: 当数据版本升级时(updateVersion)同样会触发这个方法
     * @returns
     */
    repairNativeField(): Promise<unknown>;
    /**
     * 表名
     */
    get tableName(): any;
    /** 本地sqlite存储的版本信息key */
    get DBVersionKey(): string;
    /**
     * 判断指定目录下是否存在本地数据库
     * @param dir 本地目录(前提是要把 sqlite 创建到 databases 目录下面)
     * @returns
     */
    isTableExist(dir?: string): Promise<unknown>;
    /**
     * 创建数据库
     */
    createTable(): any;
    /**
     * 新增列, 重复添加相同的列会报错
     * @param fieldOpt 新增的字段信息
     * @returns
     */
    addColumn(fieldOpt: Omit<TableFieldsOption, "isKey" | "isNotNull">): Promise<unknown>;
    /**
     * 一次添加多个列
     * @param fieldOpts 新增的字段信息
     * @returns
     */
    addColumns(fieldOpts: Omit<TableFieldsOption, "isKey" | "isNotNull">[]): Promise<unknown[]>;
    /**
     * 删除列, 一次删除删除一个字段
     * http://www.sqlite.org/faq.html#q11
     * // https://blog.csdn.net/stan1989/article/details/8570187
     * @param field 删除的字段
     * @returns
     */
    deleteColumn(field: string): Promise<unknown>;
    /**
     * 获取主键的字段名
     */
    getFieldKey(): string;
    /**
     * 获取所有的字段信息, 会自动拼接 字段和对应的值填充语句
     */
    getFields(): string[];
    /**
     * 获取数据的信息
     * @param data 数据
     * @param deleteKey deleteKey: 是否剔除主键
     * @returns
     */
    getDataInfo(data: MyObject, deleteKey?: boolean): {
        fields: string[];
        values: any[];
        map: any;
    };
    /**
     * 关闭数据库
     */
    close(): any;
    /**
     * 解析 sql 查询返回值为数组
     * @param results T[]
     * @returns
     */
    buildRet<T extends any[] = any[]>(results: [ResultSet]): T;
    private $buildUpdateByWhen;
    /**
     * 执行 update when 语句(支持大数据量, 内部会做切分执行)
     */
    buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>): Promise<ResultSet[]>;
    /**
     * 包装 executeSql 方法, 输出日志
     * @param statement sql 语句
     * @param params 数据值
     * @returns
     */
    executeSql(statement: string, params?: any[]): any;
    /**
     * 获取所有的数据
     * @param queryFields 查询显示的字段, 默认: *
     * @returns
     */
    getList<T extends MyObject[] = MyObject[]>(queryFields?: string): P<T>;
    /**
     * 获取数据总数
     * @returns
     */
    getTableCount<T extends MyObject = MyObject>(countKey?: string, where?: Partial<T>, flog?: WhereType): P<number>;
    /**
     * 根据主键进行获取
     * @param id 主键
     * @param queryFields 查询显示的字段, 默认: *
     * @returns
     */
    getById<T extends object = MyObject>(id: any, queryFields?: string): P<T>;
    /**
     * 查询数据(自定义字段和数据)
     * @param query 查询的数据
     * @param flog AND 或者 OR, 默认: AND
     * @param queryFields 需要显示的字段, 默认: *
     * @param group 分组字段
     * @returns T[]
     */
    getByCustom<T extends MyObject = MyObject>(query: Partial<T>, flog?: WhereType, queryFields?: string, group?: string): P<T[]>;
    /** 根据数组查询数据 */
    getByArray<T extends MyObject[] = MyObject[]>(data: Array<string | number>, key: string, flog?: WhereType): P<T>;
    /**
     * 插入单条数据
     * @param data T
     * @returns
     */
    insert<T extends object = MyObject>(data: Partial<T>): P<ResultSet>;
    /**
     * 插入多条数据, 数据中可以包含主键的值会被自动忽略, 因为 sqlite 一次不能超过 999 个值填充变量,
     *  内部会根据 `fieldsOption` 里的字段, 自动进行数据的分段保存
     * @param datas T[]
     * @returns
     */
    inserts<T extends MyObject[] = MyObject[]>(datas: T, maxSize?: number): P<ResultSet[]>;
    /**
     * 根据主键更新数据
     * @param data T, 数据里必须要有主键(isKey: true)
     * @returns
     */
    updateById<T extends object = MyObject>(data: Partial<T>): P;
    /**
     * 更新数据根据自定义字段
     * @param data 更新的数据
     * @param where where 条件数据
     * @param flog AND 或者 OR, 默认: AND
     * @returns
     */
    updateByCustom<T extends object = MyObject>(data: Partial<T>, where: MyObject, flog?: WhereType): P;
    /**
     * 根据主键删除数据
     * @param id 主键
     * @returns
     */
    deleteById(id: string | number): P;
    /**
     * 删除数据(根据自定义字段)
     * @param query 查询条件数据
     * @param flog AND 或者 OR, 默认: AND
     * @returns
     */
    deleteByCustom<T extends object = MyObject>(query: Partial<T>, flog?: WhereType): P;
    /**
     * 删除数据(根据自定义字段)
     */
    deleteByArray<T extends string | number = string>(data: T[], key: string, flog?: WhereType): P;
    /**
     * 请空表数据
     */
    clearTable(): P;
    /**
     * 删除表
     */
    deleteTable(): P;
    /**
     * 通用事务操作, 事务只负责执行, 里面不能执行异步操作
     * https://github.com/storesafe/cordova-sqlite-storage#using-draft-standard-transaction-api
     * @param opt
     * @returns
     */
    transaction(opt: {
        /** 处理回调 */
        handleCallback: (tx: Transaction, sqliteOrm: SqliteOrm) => void;
        /** 事务发生错误时触发 */
        transactionSuccess?: () => void;
        /** 事务发生错误时触发 */
        transactionError?: (err: SQLError) => void;
    }): Promise<unknown>;
    /**
     * 当前表信息
     * `TODO 只有表里面有数据时才会获取到表格信息`
     */
    tableInfo(): P<TableInfoType | null>;
    /**
     * 所有的表信息
     * - `TODO 只有表里面有数据时才会获取到表格信息`
     */
    allTableInfo(): P<TableInfoType[]>;
    /**
     * sqlite 版本升级
     * 需要自己重写逻辑
     */
    updateVersion(oldVersion: number, newVersion: number): Promise<void>;
    /**
     * 创建导出文件数据目录
     */
    static createDataFileDir(): P<string>;
    /**
     * 将表复制到指定目录
     */
    exportDbFile(): P<string>;
    /**
     * 将表数据导出到 JSON 文件
     */
    exportJsonFile(): P<string>;
    /**
     * 将表数据导出成 sql 文件
     */
    exportSqlFile(): P<string>;
    /**
     * 导出本地所有的 .db 数据库文件
     */
    static exportNativeAllDbFile(): Promise<unknown>;
}
export default SqliteHelper;
